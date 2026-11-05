/*
 * BUG-213 / T0866 (D291): make the standard handles and the CRT handles BAT's main process inherited from whoever
 * started it non-inheritable for the duration of one Terminal Server start, then put them back.
 *
 * Why: on Windows libuv starts every child with CreateProcessW(bInheritHandles = TRUE), so every inheritable handle
 * of the parent reaches the child. Node calls uv_disable_stdio_inheritance() at startup; Electron 45's main process
 * does not (T0865), so a Terminal Server started from BAT keeps the caller's pipes open after BAT exits.
 *
 * Same handle set as libuv's uv_disable_stdio_inheritance (src/win/process-stdio.c): GetStdHandle(input / output /
 * error) and the handles listed in STARTUPINFOW.lpReserved2 (the CRT fd table a parent passes down). Only kernel32:
 * GetStdHandle, GetStartupInfoW, GetHandleInformation, SetHandleInformation.
 *
 *   disable()         -> BigInt[]  the handles that were inheritable and are now not (only those; each once)
 *   restore(BigInt[]) -> number    how many of them were made inheritable again
 *
 * Handle values are returned to the caller only so it can restore them; electron/win-stdio-inherit.ts never logs
 * them. Nothing is closed, duplicated or replaced: GetStdHandle and the CRT keep the same handles.
 */
#include <windows.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <node_api.h>

/* The CRT fd table in lpReserved2: int count, count flag bytes, count HANDLEs (unaligned). */
#define MAX_CRT_HANDLES 2048

static int is_candidate(HANDLE h) {
  return h != NULL && h != INVALID_HANDLE_VALUE && h != (HANDLE)(intptr_t)-2;
}

/* Clears HANDLE_FLAG_INHERIT when it is set; returns 1 when this call cleared it. */
static int clear_inherit(HANDLE h) {
  DWORD flags = 0;
  if (!is_candidate(h)) return 0;
  if (!GetHandleInformation(h, &flags)) return 0;
  if (!(flags & HANDLE_FLAG_INHERIT)) return 0;
  return SetHandleInformation(h, HANDLE_FLAG_INHERIT, 0) ? 1 : 0;
}

static napi_value throw_status(napi_env env, const char* what) {
  napi_throw_error(env, "BAT_WIN_STDIO_INHERIT", what);
  return NULL;
}

static napi_value Disable(napi_env env, napi_callback_info info) {
  static const DWORD std_ids[3] = { STD_INPUT_HANDLE, STD_OUTPUT_HANDLE, STD_ERROR_HANDLE };
  HANDLE* cleared = NULL;
  size_t cleared_count = 0;
  size_t capacity = 3;
  int crt_count = 0;
  const unsigned char* crt = NULL;
  STARTUPINFOW si;
  napi_value result;
  size_t i;
  (void)info;

  memset(&si, 0, sizeof(si));
  si.cb = sizeof(si);
  GetStartupInfoW(&si);
  if (si.lpReserved2 != NULL && si.cbReserved2 >= sizeof(int)) {
    int count = 0;
    memcpy(&count, si.lpReserved2, sizeof(int));
    if (count > 0 && count <= MAX_CRT_HANDLES
        && (size_t)si.cbReserved2 >= sizeof(int) + (size_t)count * (sizeof(unsigned char) + sizeof(HANDLE))) {
      crt_count = count;
      crt = (const unsigned char*)si.lpReserved2 + sizeof(int) + (size_t)count;
      capacity += (size_t)count;
    }
  }

  cleared = (HANDLE*)calloc(capacity, sizeof(HANDLE));
  if (cleared == NULL) return throw_status(env, "out of memory");

  for (i = 0; i < 3; i++) {
    HANDLE h = GetStdHandle(std_ids[i]);
    if (clear_inherit(h)) cleared[cleared_count++] = h;
  }
  for (i = 0; i < (size_t)crt_count; i++) {
    HANDLE h;
    memcpy(&h, crt + i * sizeof(HANDLE), sizeof(HANDLE));
    /* a handle already cleared above (fd 1 is usually the stdout handle) is no longer inheritable: not listed twice */
    if (clear_inherit(h)) cleared[cleared_count++] = h;
  }

  if (napi_create_array_with_length(env, cleared_count, &result) != napi_ok) {
    /* put back what was changed before failing, so a failed call leaves nothing behind */
    for (i = 0; i < cleared_count; i++) SetHandleInformation(cleared[i], HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT);
    free(cleared);
    return throw_status(env, "napi_create_array_with_length failed");
  }
  for (i = 0; i < cleared_count; i++) {
    napi_value v;
    if (napi_create_bigint_uint64(env, (uint64_t)(uintptr_t)cleared[i], &v) != napi_ok
        || napi_set_element(env, result, (uint32_t)i, v) != napi_ok) {
      size_t j;
      for (j = 0; j < cleared_count; j++) SetHandleInformation(cleared[j], HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT);
      free(cleared);
      return throw_status(env, "creating the result failed");
    }
  }
  free(cleared);
  return result;
}

static napi_value Restore(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_value list;
  napi_value result;
  bool is_array = false;
  uint32_t length = 0;
  uint32_t i;
  uint32_t restored = 0;

  if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok || argc < 1) return throw_status(env, "restore(handles) needs an array");
  list = argv[0];
  if (napi_is_array(env, list, &is_array) != napi_ok || !is_array) return throw_status(env, "restore(handles) needs an array");
  if (napi_get_array_length(env, list, &length) != napi_ok) return throw_status(env, "napi_get_array_length failed");

  for (i = 0; i < length; i++) {
    napi_value v;
    uint64_t value = 0;
    bool lossless = false;
    HANDLE h;
    if (napi_get_element(env, list, i, &v) != napi_ok) continue;
    if (napi_get_value_bigint_uint64(env, v, &value, &lossless) != napi_ok || !lossless) continue;
    h = (HANDLE)(uintptr_t)value;
    if (!is_candidate(h)) continue;
    if (SetHandleInformation(h, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT)) restored++;
  }
  if (napi_create_uint32(env, restored, &result) != napi_ok) return throw_status(env, "napi_create_uint32 failed");
  return result;
}

static napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor props[] = {
    { "disable", NULL, Disable, NULL, NULL, NULL, napi_default, NULL },
    { "restore", NULL, Restore, NULL, NULL, NULL, napi_default, NULL },
  };
  if (napi_define_properties(env, exports, sizeof(props) / sizeof(props[0]), props) != napi_ok) return NULL;
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
