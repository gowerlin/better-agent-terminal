// T0485 test fixture: a module whose body throws, like a native addon failing to load.
export {}
throw new Error('t0485 fake module failed at import')
