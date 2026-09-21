import { requireMember } from "@/app/server-auth";
import { getDashboardData } from "@/app/server-dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const { member,response }=await requireMember();
  if (!member || response) return response;
  return Response.json(await getDashboardData(member));
}
