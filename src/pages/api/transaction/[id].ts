import { defineRoute, ApiError } from "@/lib/api/define-route";
import { makeTransactionQuery } from "@/composition/make-payments";

export const GET = defineRoute("GET /api/transaction/:id", { feature: "TRANSACTIONS" }, async ({ params }) => {
  const txn = await makeTransactionQuery().get(params.id!);
  if (!txn) throw new ApiError(404, "Transaction not found");
  return txn;
});
