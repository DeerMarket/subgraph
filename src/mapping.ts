import { near, json, log, JSONValueKind } from "@graphprotocol/graph-ts";
import { handleDMS297Event } from "./dms297";

export function handleReceipt(receipt: near.ReceiptWithOutcome): void {
  const actions = receipt.receipt.actions;

  for (let i = 0; i < actions.length; i++) {
    handleAction(actions[i], receipt);
  }
}

function handleAction(
  action: near.ActionValue,
  receipt: near.ReceiptWithOutcome
): void {
  if (action.kind != near.ActionKind.FUNCTION_CALL) {
    log.info("Early return: {}", ["Not a function call"]);
    return;
  }

  const functionCall = action.toFunctionCall();
  const outcome = receipt.outcome;

  if (outcome.logs != null && outcome.logs.length > 0) {
    if (outcome.logs[0].split(":")[0] == "EVENT_JSON") {
      // remove the "EVENT_JSON:" prefix
      const jsonStr = outcome.logs[0].substr(11);
      let parsed = json.fromString(jsonStr);

      if (parsed.kind == JSONValueKind.OBJECT) {
        let entry = parsed.toObject();
        let standard = entry.get("standard");

        if (standard != null && standard.toString() == "dms297") {
          let event = entry.get("event");
          let data = entry.get("data");
          if (event != null && data != null) {
            handleDMS297Event(event.toString(), data, receipt);
          }
        }
      }
    }
  }

  // // Parse the json object from receipt logs, remove NEAR EVENT_JSON hook from string before
  // // const event = json.fromString(outcome.logs[0].replace("EVENT_JSON:", ""));

  // // Event handler that maps data to GraphQl entities
  // log.info("Event: " + outcome.logs[0], []);
}
