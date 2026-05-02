import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated code
    "src/generated/**",
    // Design reference (raw JSX from the design handoff, not part of the app)
    "design-reference/**",
  ]),
  {
    // Restrict lucide-react imports to shadcn/ui components only
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lucide-react",
              message:
                "Use @heroicons/react instead. lucide-react is reserved for internal shadcn/ui components.",
            },
          ],
        },
      ],
    },
  },
  {
    // Forbid Prisma's unsafe raw query helpers — they accept string
    // interpolation and are an SQL-injection trap. Use the tagged-template
    // variants ($queryRaw / $executeRaw) instead.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/generated/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[property.name=/^\\$(query|execute)RawUnsafe$/]",
          message:
            "Use prisma.$queryRaw / prisma.$executeRaw (tagged templates) — they parameterize safely. Never $queryRawUnsafe / $executeRawUnsafe.",
        },
      ],
    },
  },
]);

export default eslintConfig;
