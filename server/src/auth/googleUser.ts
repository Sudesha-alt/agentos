import { prisma } from "../db/client";
import { displayNameFromEmail } from "../api/routes/authSession";
import type { GoogleUserProfile } from "./googleOAuth";

export async function findOrCreateGoogleUser(profile: GoogleUserProfile) {
  const byGoogleId = await prisma.user.findUnique({
    where: { googleId: profile.sub },
  });
  if (byGoogleId) {
    if (byGoogleId.name !== profile.name) {
      return prisma.user.update({
        where: { id: byGoogleId.id },
        data: { name: profile.name },
      });
    }
    return byGoogleId;
  }

  const byEmail = await prisma.user.findUnique({
    where: { email: profile.email },
  });

  if (byEmail) {
    if (byEmail.googleId && byEmail.googleId !== profile.sub) {
      throw new Error("google_account_conflict");
    }
    return prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleId: profile.sub,
        name: profile.name || byEmail.name,
      },
    });
  }

  return prisma.user.create({
    data: {
      email: profile.email,
      name: profile.name || displayNameFromEmail(profile.email),
      googleId: profile.sub,
      passwordHash: null,
    },
  });
}
