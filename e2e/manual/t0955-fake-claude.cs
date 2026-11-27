// T0955: fake `claude.exe` for the v0.8.1-pre.1 automated acceptance (see e2e/manual/README.md).
//
// Compiled by e2e/manual/t0955-v081-acceptance.ts with the .NET Framework csc.exe into a results directory
// outside the repo. BAT's system-claude detection only accepts a real `claude.exe` (spawn() refuses .cmd shims),
// so this small exe stands in for claude. It never talks to a model.
//   - `--version` (BAT's health probe and `--name` version check): prints `2.1.331 (Claude Code)` and exits 0.
//   - `auth status` with control.json `"authStatus": "loggedOut"` (T0959, opt-in): prints a logged-out status
//     JSON and exits 1, like claude when nobody is logged in.
//   - stdin not a console (any other non-interactive call): records argv and exits 0, so nothing hangs.
//   - otherwise (started in a BAT tab), like claude's TUI:
//       1. records the raw command line and argv to <dataDir>/run-<stamp>-<pid>.argv.txt;
//       2. console input in VT mode (ENABLE_VIRTUAL_TERMINAL_INPUT, no line / echo / processed input) and output
//          with VT processing — ConPTY only forwards mouse-mode requests and SGR mouse reports in this mode;
//       3. `node t0955-fake-claude.mjs meta` (stdio redirected, never the console) writes <run>.meta.json;
//       4. prints 5 marker lines `T0955-MARK-<pid>-<n>` and 60 filler lines in the normal buffer;
//       5. an argument exactly `/control-tower` → `node t0955-fake-claude.mjs setrole` declares the Tower;
//       6. control.json `"fullscreen": false` → stays in the normal buffer; otherwise alt screen + any-motion mouse
//          tracking + SGR encoding + hidden cursor (ESC[?1049h ESC[?1003h ESC[?1006h ESC[?25l);
//       7. `node t0955-fake-claude.mjs serve` in the background answers driver commands;
//       8. logs every stdin chunk (`<ISO time> <base64>` per line) to <run>.stdin.log until the console goes away.
// Configuration: fake-claude.cfg next to the exe, UTF-8, three lines: node path, fake script path, data directory.
// No secrets are read or written: argv only (BAT never puts a token on the command line).

using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

class FakeClaude
{
    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr GetStdHandle(int n);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool GetConsoleMode(IntPtr h, out uint m);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool SetConsoleMode(IntPtr h, uint m);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool SetConsoleCP(uint cp);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool SetConsoleOutputCP(uint cp);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool ReadFile(IntPtr h, byte[] buf, uint n, out uint read, IntPtr overlapped);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool WriteFile(IntPtr h, byte[] buf, uint n, out uint written, IntPtr overlapped);

    const int STD_INPUT = -10, STD_OUTPUT = -11;
    const uint ENABLE_EXTENDED_FLAGS = 0x0080, ENABLE_VIRTUAL_TERMINAL_INPUT = 0x0200;
    const uint ENABLE_PROCESSED_OUTPUT = 0x0001, ENABLE_WRAP_AT_EOL_OUTPUT = 0x0002, ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004;

    static IntPtr stdout;
    static string node, script, argvFile, dataDir;
    static int pid;

    static void Out(string s)
    {
        byte[] b = Encoding.UTF8.GetBytes(s);
        uint w;
        WriteFile(stdout, b, (uint)b.Length, out w, IntPtr.Zero);
    }

    static Process Node(string mode, bool wait)
    {
        ProcessStartInfo psi = new ProcessStartInfo(node, "\"" + script + "\" " + mode);
        psi.UseShellExecute = false;
        psi.CreateNoWindow = true;
        psi.RedirectStandardInput = true;
        psi.RedirectStandardOutput = true;
        psi.RedirectStandardError = true;
        psi.EnvironmentVariables["FAKE_CLAUDE_ARGV_FILE"] = argvFile;
        psi.EnvironmentVariables["FAKE_CLAUDE_DATA_DIR"] = dataDir;
        psi.EnvironmentVariables["FAKE_CLAUDE_LAUNCHER_PID"] = pid.ToString();
        Process p = Process.Start(psi);
        p.StandardInput.Close();
        if (wait)
        {
            p.StandardOutput.ReadToEnd();
            p.StandardError.ReadToEnd();
            p.WaitForExit(60000);
        }
        return p;
    }

    static string Now() { return DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"); }

    static int Main(string[] args)
    {
        if (args.Length == 1 && args[0] == "--version")
        {
            Console.WriteLine("2.1.331 (Claude Code)");
            return 0;
        }
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        string[] cfg = File.ReadAllLines(Path.Combine(baseDir, "fake-claude.cfg"), Encoding.UTF8);
        node = cfg[0].Trim();
        script = cfg[1].Trim();
        dataDir = cfg[2].Trim();
        Directory.CreateDirectory(dataDir);
        pid = Process.GetCurrentProcess().Id;
        string stamp = DateTime.Now.ToString("yyyyMMdd-HHmmss-fff");
        argvFile = Path.Combine(dataDir, "run-" + stamp + "-" + pid + ".argv.txt");
        string runBase = argvFile.Substring(0, argvFile.Length - ".argv.txt".Length);
        StringBuilder sb = new StringBuilder();
        sb.Append("cmdline=").Append(Environment.CommandLine).Append('\n');
        sb.Append("argc=").Append(args.Length).Append('\n');
        for (int i = 0; i < args.Length; i++) sb.Append("argv[").Append(i).Append("]=").Append(args[i]).Append('\n');
        // T0959 (opt-in): control.json `"authStatus": "loggedOut"` → `auth status` answers like a logged-out claude
        // (JSON with loggedIn false on stdout, exit 1), so the Claude Agent panel shows its "not logged in" guide.
        // Without that key this branch does nothing and the T0955 behavior below is unchanged.
        if (args.Length == 2 && args[0] == "auth" && args[1] == "status")
        {
            string ctl = "";
            try { ctl = File.ReadAllText(Path.Combine(dataDir, "control.json")); } catch (Exception) { }
            if (ctl.Replace(" ", "").IndexOf("\"authStatus\":\"loggedOut\"") >= 0)
            {
                File.WriteAllText(runBase + ".auth-status.txt", sb.ToString(), new UTF8Encoding(false));
                Console.Write("{\"loggedIn\": false, \"authMethod\": \"none\", \"apiProvider\": \"firstParty\"}");
                return 1;
            }
        }
        if (Console.IsInputRedirected)
        {
            sb.Append("noninteractive=1\n");
            File.WriteAllText(runBase + ".noninteractive.txt", sb.ToString(), new UTF8Encoding(false));
            return 0;
        }
        File.WriteAllText(argvFile, sb.ToString(), new UTF8Encoding(false));

        IntPtr stdin = GetStdHandle(STD_INPUT);
        stdout = GetStdHandle(STD_OUTPUT);
        uint inMode, outMode;
        GetConsoleMode(stdin, out inMode);
        GetConsoleMode(stdout, out outMode);
        SetConsoleCP(65001);
        SetConsoleOutputCP(65001);
        bool inOk = SetConsoleMode(stdin, ENABLE_EXTENDED_FLAGS | ENABLE_VIRTUAL_TERMINAL_INPUT);
        bool outOk = SetConsoleMode(stdout, ENABLE_PROCESSED_OUTPUT | ENABLE_WRAP_AT_EOL_OUTPUT | ENABLE_VIRTUAL_TERMINAL_PROCESSING);
        File.WriteAllText(runBase + ".console.txt", "inMode=0x" + inMode.ToString("x") + " outMode=0x" + outMode.ToString("x") +
            " setIn=" + inOk + " setOut=" + outOk + "\n", new UTF8Encoding(false));

        Node("meta", true);
        for (int i = 1; i <= 5; i++) Out("T0955-MARK-" + pid + "-" + i + "\r\n");
        for (int i = 1; i <= 60; i++) Out("T0955-FILL-" + pid + "-" + i + "\r\n");
        if (Array.IndexOf(args, "/control-tower") >= 0) Node("setrole", true);

        string control = "";
        try { control = File.ReadAllText(Path.Combine(dataDir, "control.json")); } catch (Exception) { }
        bool fullscreen = control.Replace(" ", "").IndexOf("\"fullscreen\":false") < 0;
        if (fullscreen)
        {
            Out("\u001b[?1049h\u001b[?1003h\u001b[?1006h\u001b[?25l");
            Out("\u001b[2J\u001b[HFAKE CLAUDE (T0955) fullscreen + mouse tracking\r\n");
        }
        else
        {
            Out("FAKE CLAUDE (T0955) normal buffer, reading stdin\r\n");
        }
        File.WriteAllText(runBase + ".state.json", "{\"at\":\"" + Now() + "\",\"phase\":\"" + (fullscreen ? "fullscreen" : "normal") + "\"}\n", new UTF8Encoding(false));

        Node("serve", false);

        byte[] buf = new byte[4096];
        uint n;
        string log = runBase + ".stdin.log";
        while (ReadFile(stdin, buf, (uint)buf.Length, out n, IntPtr.Zero))
        {
            if (n == 0) { System.Threading.Thread.Sleep(10); continue; }
            File.AppendAllText(log, Now() + " " + Convert.ToBase64String(buf, 0, (int)n) + "\n", new UTF8Encoding(false));
        }
        return 0;
    }
}
