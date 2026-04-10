import { useLocation, Navigate } from "react-router-dom";

export default function AIStudioRedirect() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const task = params.get("task");
  const lang = params.get("lang");

  const TASK_TO_INTENT: Record<string, string> = {
    rewrite: "rewrite",
    translate: "translate",
    allergens: "allergens",
    calories: "calories",
  };

  const intent = task ? TASK_TO_INTENT[task] : null;

  let target = "/menu";
  if (intent) {
    target = `/menu?intent=${intent}${intent === "translate" && lang ? `&lang=${lang}` : ""}`;
  }

  return <Navigate to={target} replace />;
}
