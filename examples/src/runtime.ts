export interface Contract {
  id: string;
  approved: boolean;
}

export function validateContract(contract: Contract): void {
  if (!contract.approved) throw new Error(`Contract ${contract.id} is not approved`);
}

export function executeContract(contract: Contract): string {
  validateContract(contract);
  return `executed:${contract.id}`;
}
