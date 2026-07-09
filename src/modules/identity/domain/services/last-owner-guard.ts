export class LastOwnerGuard {
  assertCanRemove(input: { ownerMembershipCount: number; targetIsOwner: boolean }): void {
    if (input.targetIsOwner && input.ownerMembershipCount <= 1) {
      throw new Error('Cannot remove the last owner of a tenant');
    }
  }
}
