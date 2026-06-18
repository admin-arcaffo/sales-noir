import { auth } from "@clerk/nextjs/server";
import LandingClient from "./LandingClient";

export default async function Home() {
  const { userId } = await auth();
  return <LandingClient isSignedIn={!!userId} />;
}
