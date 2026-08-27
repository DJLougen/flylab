import { flyLabAgentContractDocument } from '@/lib/agent-contract-document';

export const dynamic = 'force-static';

export function GET() {
  return Response.json(flyLabAgentContractDocument, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    },
  });
}
