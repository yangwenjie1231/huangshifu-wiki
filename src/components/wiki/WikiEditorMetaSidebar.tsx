import React from "react";
import { Save, Send } from "lucide-react";

interface WikiEditorMetaSidebarProps {
	savingMode: "draft" | "pending" | null;
	onSubmit: (status: "draft" | "pending") => void;
}

const WikiEditorMetaSidebar = React.memo(({
	savingMode,
	onSubmit,
}: WikiEditorMetaSidebarProps) => {
	return (
		<div className="pt-6 flex flex-wrap justify-end gap-3">
			<button
				type="button"
				onClick={() => onSubmit("draft")}
				disabled={Boolean(savingMode)}
				className="px-6 py-2.5 bg-surface-alt text-text-secondary border border-border rounded text-sm font-medium hover:border-brand-gold hover:text-brand-gold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<Save size={16} />{" "}
				{savingMode === "draft" ? "保存中..." : "保存草稿"}
			</button>
			<button
				type="submit"
				disabled={Boolean(savingMode)}
				className="px-8 py-2.5 theme-button-primary rounded text-sm font-medium active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<Send size={16} />{" "}
				{savingMode === "pending" ? "提交中..." : "提交审核"}
			</button>
		</div>
	);
});

WikiEditorMetaSidebar.displayName = "WikiEditorMetaSidebar";

export default WikiEditorMetaSidebar;
