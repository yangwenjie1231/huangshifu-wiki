import React from "react";
import { Save, Sparkles } from "lucide-react";

interface WikiEditorMetaSidebarProps {
	savingMode: "draft" | "pending" | null;
	onSubmit: (status: "draft" | "pending") => void;
}

const WikiEditorMetaSidebar = React.memo(({
	savingMode,
	onSubmit,
}: WikiEditorMetaSidebarProps) => {
	return (
		<div className="pt-8 flex flex-wrap justify-end gap-3">
			<button
				type="button"
				onClick={() => onSubmit("draft")}
				disabled={Boolean(savingMode)}
				className="px-6 py-2.5 bg-surface-alt text-text-secondary rounded font-medium hover:bg-bg-tertiary transition-all flex items-center gap-2 disabled:opacity-50"
			>
				<Save size={18} />{" "}
				{savingMode === "draft" ? "保存中..." : "保存草稿"}
			</button>
			<button
				type="submit"
				disabled={Boolean(savingMode)}
				className="px-8 py-2.5 theme-button-primary rounded font-medium transition-all flex items-center gap-2 disabled:opacity-50"
			>
				<Sparkles size={18} />{" "}
				{savingMode === "pending" ? "提交中..." : "提交审核"}
			</button>
		</div>
	);
});

WikiEditorMetaSidebar.displayName = "WikiEditorMetaSidebar";

export default WikiEditorMetaSidebar;
