## Decisions

- **No new state column.** "Held while idle" vs "waiting for the running round" is implied by whether a round is active: queues only auto-send at the end of a round, so an idle queue just waits. A retry started while the queue holds messages will send them when it ends — consistent with "a queue is sent when a round ends".
- **Startup**: `recoverInterruptedResearchSteps` now returns the affected session ids (it already finds them); `index.ts` dispatches only those after `listen`. `dispatchAllQueuedMessages` is replaced by `dispatchQueuedMessagesFor(sessionIds)`.
- **API**: `{ user_text?, model_name, queue_only? }`. `queue_only` requires text. Without `queue_only`: insert the text if present, then dispatch (idle → 201 with a round; active → 202). Empty text with an empty queue → 400. The model of a send without text is the request's `model_name` (it becomes the latest choice): the merged round uses the model given at send time when there is one, otherwise the latest queued message's model.

