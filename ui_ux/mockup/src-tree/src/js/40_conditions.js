/* JSON predicate evaluator (no eval). ctx = {system, farm, entity, ui} */
(function (ICL) {
  function get(ctx, path) {
    return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), ctx);
  }
  function evaluate(pred, ctx) {
    if (pred == null || pred === "always") return true;
    if (pred === "never") return false;
    if (Array.isArray(pred.all)) return pred.all.every((p) => evaluate(p, ctx));
    if (Array.isArray(pred.any)) return pred.any.some((p) => evaluate(p, ctx));
    if (pred.not) return !evaluate(pred.not, ctx);
    const v = get(ctx, pred.path);
    if ("eq" in pred) return v === pred.eq;
    if ("neq" in pred) return v !== pred.neq;
    if ("in" in pred) return Array.isArray(v) ? v.some((x) => pred.in.includes(x)) : pred.in.includes(v);
    if ("gt" in pred) return typeof v === "number" && v > pred.gt;
    if ("gte" in pred) return typeof v === "number" && v >= pred.gte;
    if ("lt" in pred) return typeof v === "number" && v < pred.lt;
    if ("truthy" in pred) return !!v === !!pred.truthy;
    if ("empty" in pred) return (v == null || v === "" || (Array.isArray(v) && !v.length)) === !!pred.empty;
    return true;
  }
  const visible = (f, ctx) => evaluate(f.visible_if, ctx);
  const required = (f, ctx) => (f.required_if === "always" ? true : f.required_if ? evaluate(f.required_if, ctx) : false);
  const sectionVisible = (sec, state) => evaluate(sec.visible_if, { system: state.system, farm: state.farm, ui: state.ui });
  ICL.cond = { evaluate, visible, required, sectionVisible, get };
})(window.ICL);
