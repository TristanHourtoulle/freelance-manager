import { linearClient } from "@/lib/linear"
import type { LinearIssueSearchResult } from "./linear-types"

interface RawIssueSearchResponse {
  issueSearch: {
    nodes: Array<{
      id: string
      identifier: string
      title: string
      url: string
    }>
  }
}

/**
 * Searches Linear issues by text query using a GraphQL search.
 * Returns up to 5 matching results.
 *
 * @param query - Free-text search query
 * @returns Array of lightweight search results
 */
export async function searchLinearIssues(
  query: string,
): Promise<LinearIssueSearchResult[]> {
  const gql = `
    query SearchIssues($query: String!) {
      issueSearch(query: $query, first: 5) {
        nodes {
          id
          identifier
          title
          url
        }
      }
    }
  `

  const response = await linearClient.client.rawRequest<
    RawIssueSearchResponse,
    { query: string }
  >(gql, { query })

  if (!response.data) {
    return []
  }

  return response.data.issueSearch.nodes.map((node) => ({
    id: node.id,
    identifier: node.identifier,
    title: node.title,
    url: node.url,
  }))
}
