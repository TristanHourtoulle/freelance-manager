import { cloneDatabase } from "./db"

async function main(): Promise<void> {
  const [baseUrl, database, template] = process.argv.slice(2)
  if (!baseUrl || !database || !template) {
    throw new Error(
      "Usage: clone-database-cli.ts <baseUrl> <database> <template>",
    )
  }
  await cloneDatabase(baseUrl, database, template)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
