import { relay } from "../../relay/relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Local copy of the relay, used when running the hosted build with `npm run dev:browser`.
const handler = (req: Request) => relay(req, { origin: new URL(req.url).origin, allowPrivate: process.env.CAPSULE_ALLOW_PRIVATE_URLS === "1" });
export { handler as GET, handler as POST };
