export function createSessionGuard() {
  let generation = 0;
  let requestSequence = 0;
  let uid: string | null = null;
  return {
    begin(nextUid: string | null) {
      if (nextUid !== uid) { generation += 1; uid = nextUid; requestSequence += 1; }
      return generation;
    },
    advance(candidateUid: string) {
      if (uid !== candidateUid) return null;
      generation += 1;
      requestSequence += 1;
      return generation;
    },
    invalidate() { generation += 1; uid = null; requestSequence += 1; return generation; },
    isCurrent(candidateUid: string, candidateGeneration: number) { return uid === candidateUid && generation === candidateGeneration; },
    beginRequest(candidateUid: string, candidateGeneration: number) {
      if (uid !== candidateUid || generation !== candidateGeneration) return null;
      requestSequence += 1;
      return requestSequence;
    },
    isCurrentRequest(candidateUid: string, candidateGeneration: number, sequence: number) {
      return uid === candidateUid && generation === candidateGeneration && requestSequence === sequence;
    },
    currentUid() { return uid; },
    currentGeneration() { return generation; },
  };
}
