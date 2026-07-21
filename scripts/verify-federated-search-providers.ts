import { checkFederatedSearchProviders } from "@/lib/scanner/search-providers/health";

if (!process.argv.includes("--live")) {
  throw new Error("Canlı sağlayıcı çağrıları için --live kullanın.");
}

void main();

async function main() {
  const results = await checkFederatedSearchProviders({
    query: process.env.FEDERATED_SEARCH_ACCEPTANCE_QUERY,
  });
  console.log(JSON.stringify(results, null, 2));

  if (results.some((result) => !result.ok)) process.exitCode = 1;
}
