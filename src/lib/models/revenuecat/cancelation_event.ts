// To parse this data:
//
//   import { Convert, CancelationEvent } from "./file";
//
//   const cancelationEvent = Convert.toCancelationEvent(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface CancelationEvent {
  event: Event;
  api_version: string;
}

export interface Event {
  event_timestamp_ms: number;
  product_id: string;
  period_type: string;
  purchased_at_ms: number;
  expiration_at_ms: number;
  environment: string;
  entitlement_id: string;
  entitlement_ids: string[];
  presented_offering_id: string;
  transaction_id: string;
  original_transaction_id: string;
  app_user_id: string;
  aliases: string[];
  offer_code: string;
  original_app_user_id: string;
  cancel_reason: string;
  currency: string;
  price: number;
  price_in_purchased_currency: number;
  subscriber_attributes: SubscriberAttributes;
  store: string;
  takehome_percentage: number;
  type: string;
  id: string;
}

export interface SubscriberAttributes {
  $idfa: AppsflyerID;
  $appsflyerId: AppsflyerID;
  favorite_food: AppsflyerID;
}

export interface AppsflyerID {
  value: string;
  updated_at_ms: number;
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
  public static toCancelationEvent(json: string): CancelationEvent {
    return cast(JSON.parse(json), r("CancelationEvent"));
  }

  public static cancelationEventToJson(value: CancelationEvent): string {
    return JSON.stringify(uncast(value, r("CancelationEvent")), null, 2);
  }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ""): never {
  const prettyTyp = prettyTypeName(typ);
  const parentText = parent ? ` on ${parent}` : "";
  const keyText = key ? ` for key "${key}"` : "";
  throw Error(
    `Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`
  );
}

function prettyTypeName(typ: any): string {
  if (Array.isArray(typ)) {
    if (typ.length === 2 && typ[0] === undefined) {
      return `an optional ${prettyTypeName(typ[1])}`;
    } else {
      return `one of [${typ
        .map((a) => {
          return prettyTypeName(a);
        })
        .join(", ")}]`;
    }
  } else if (typeof typ === "object" && typ.literal !== undefined) {
    return typ.literal;
  } else {
    return typeof typ;
  }
}

function jsonToJSProps(typ: any): any {
  if (typ.jsonToJS === undefined) {
    const map: any = {};
    typ.props.forEach((p: any) => (map[p.json] = { key: p.js, typ: p.typ }));
    typ.jsonToJS = map;
  }
  return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
  if (typ.jsToJSON === undefined) {
    const map: any = {};
    typ.props.forEach((p: any) => (map[p.js] = { key: p.json, typ: p.typ }));
    typ.jsToJSON = map;
  }
  return typ.jsToJSON;
}

function transform(
  val: any,
  typ: any,
  getProps: any,
  key: any = "",
  parent: any = ""
): any {
  function transformPrimitive(typ: string, val: any): any {
    if (typeof typ === typeof val) return val;
    return invalidValue(typ, val, key, parent);
  }

  function transformUnion(typs: any[], val: any): any {
    // val must validate against one typ in typs
    const l = typs.length;
    for (let i = 0; i < l; i++) {
      const typ = typs[i];
      try {
        return transform(val, typ, getProps);
      } catch (_) {}
    }
    return invalidValue(typs, val, key, parent);
  }

  function transformEnum(cases: string[], val: any): any {
    if (cases.indexOf(val) !== -1) return val;
    return invalidValue(
      cases.map((a) => {
        return l(a);
      }),
      val,
      key,
      parent
    );
  }

  function transformArray(typ: any, val: any): any {
    // val must be an array with no invalid elements
    if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
    return val.map((el) => transform(el, typ, getProps));
  }

  function transformDate(val: any): any {
    if (val === null) {
      return null;
    }
    const d = new Date(val);
    if (isNaN(d.valueOf())) {
      return invalidValue(l("Date"), val, key, parent);
    }
    return d;
  }

  function transformObject(
    props: { [k: string]: any },
    additional: any,
    val: any
  ): any {
    if (val === null || typeof val !== "object" || Array.isArray(val)) {
      return invalidValue(l(ref || "object"), val, key, parent);
    }
    const result: any = {};
    Object.getOwnPropertyNames(props).forEach((key) => {
      const prop = props[key];
      const v = Object.prototype.hasOwnProperty.call(val, key)
        ? val[key]
        : undefined;
      result[prop.key] = transform(v, prop.typ, getProps, key, ref);
    });
    Object.getOwnPropertyNames(val).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(props, key)) {
        result[key] = transform(val[key], additional, getProps, key, ref);
      }
    });
    return result;
  }

  if (typ === "any") return val;
  if (typ === null) {
    if (val === null) return val;
    return invalidValue(typ, val, key, parent);
  }
  if (typ === false) return invalidValue(typ, val, key, parent);
  let ref: any = undefined;
  while (typeof typ === "object" && typ.ref !== undefined) {
    ref = typ.ref;
    typ = typeMap[typ.ref];
  }
  if (Array.isArray(typ)) return transformEnum(typ, val);
  if (typeof typ === "object") {
    return typ.hasOwnProperty("unionMembers")
      ? transformUnion(typ.unionMembers, val)
      : typ.hasOwnProperty("arrayItems")
        ? transformArray(typ.arrayItems, val)
        : typ.hasOwnProperty("props")
          ? transformObject(getProps(typ), typ.additional, val)
          : invalidValue(typ, val, key, parent);
  }
  // Numbers can be parsed by Date but shouldn't be.
  if (typ === Date && typeof val !== "number") return transformDate(val);
  return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
  return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
  return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
  return { literal: typ };
}

function a(typ: any) {
  return { arrayItems: typ };
}

function u(...typs: any[]) {
  return { unionMembers: typs };
}

function o(props: any[], additional: any) {
  return { props, additional };
}

function m(additional: any) {
  return { props: [], additional };
}

function r(name: string) {
  return { ref: name };
}

const typeMap: any = {
  CancelationEvent: o(
    [
      { json: "event", js: "event", typ: r("Event") },
      { json: "api_version", js: "api_version", typ: "" },
    ],
    false
  ),
  Event: o(
    [
      { json: "event_timestamp_ms", js: "event_timestamp_ms", typ: 0 },
      { json: "product_id", js: "product_id", typ: "" },
      { json: "period_type", js: "period_type", typ: "" },
      { json: "purchased_at_ms", js: "purchased_at_ms", typ: 0 },
      { json: "expiration_at_ms", js: "expiration_at_ms", typ: 0 },
      { json: "environment", js: "environment", typ: "" },
      { json: "entitlement_id", js: "entitlement_id", typ: "" },
      { json: "entitlement_ids", js: "entitlement_ids", typ: a("") },
      { json: "presented_offering_id", js: "presented_offering_id", typ: "" },
      { json: "transaction_id", js: "transaction_id", typ: "" },
      {
        json: "original_transaction_id",
        js: "original_transaction_id",
        typ: "",
      },
      { json: "app_user_id", js: "app_user_id", typ: "" },
      { json: "aliases", js: "aliases", typ: a("") },
      { json: "offer_code", js: "offer_code", typ: "" },
      { json: "original_app_user_id", js: "original_app_user_id", typ: "" },
      { json: "cancel_reason", js: "cancel_reason", typ: "" },
      { json: "currency", js: "currency", typ: "" },
      { json: "price", js: "price", typ: 0 },
      {
        json: "price_in_purchased_currency",
        js: "price_in_purchased_currency",
        typ: 0,
      },
      {
        json: "subscriber_attributes",
        js: "subscriber_attributes",
        typ: r("SubscriberAttributes"),
      },
      { json: "store", js: "store", typ: "" },
      { json: "takehome_percentage", js: "takehome_percentage", typ: 3.14 },
      { json: "type", js: "type", typ: "" },
      { json: "id", js: "id", typ: "" },
    ],
    false
  ),
  SubscriberAttributes: o(
    [
      { json: "$idfa", js: "$idfa", typ: r("AppsflyerID") },
      { json: "$appsflyerId", js: "$appsflyerId", typ: r("AppsflyerID") },
      { json: "favorite_food", js: "favorite_food", typ: r("AppsflyerID") },
    ],
    false
  ),
  AppsflyerID: o(
    [
      { json: "value", js: "value", typ: "" },
      { json: "updated_at_ms", js: "updated_at_ms", typ: 0 },
    ],
    false
  ),
};

export function convertToCancelationEvent(json: any): CancelationEvent {
  return cast(json, r("CancelationEvent"))
}