export function shouldApplyOnlineSnapshot(currentGame, incomingGame) {
  if (!currentGame || currentGame.id !== incomingGame?.id) return true;
  const currentRevision = Number(currentGame.revision);
  const incomingRevision = Number(incomingGame.revision);
  if (!Number.isSafeInteger(currentRevision) || !Number.isSafeInteger(incomingRevision)) return true;
  return incomingRevision >= currentRevision;
}
