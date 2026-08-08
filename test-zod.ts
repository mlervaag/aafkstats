import { z } from "zod";
import { contribution } from "./packages/schema/src/contribution.js";

const data = {
  id: "gh-2",
  scope: "match",
  targetId: "2011-05-25-hodd-aalesunds-fk",
  category: "memory",
  text: "Lypsyl!",
  submittedAt: "2026-08-06",
  verification: "unverified"
};

const result = contribution.safeParse(data);
console.log(result.success ? "Success" : result.error.issues);
