import { createServer } from "node:net"

/**
 * Ask the OS for an ephemeral TCP port that is free right now.
 *
 * Used to bind the throwaway Next.js server spawned for integration tests
 * without hardcoding a port number that could collide with another local
 * process (dev server, another test run, …).
 *
 * @returns A port number free at the moment of the call.
 */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on("error", reject)
    server.listen(0, () => {
      const address = server.address()
      if (address === null || typeof address === "string") {
        reject(new Error("Could not determine a free port"))
        return
      }
      const { port } = address
      server.close(() => resolve(port))
    })
  })
}
