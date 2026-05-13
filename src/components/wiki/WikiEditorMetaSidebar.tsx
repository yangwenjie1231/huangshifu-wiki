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
				className="px-6 py-2.5 bg-[#f7f5f0] text-[#6b6560] rounded font-medium hover:bg-[#e8e4db] transition-all flex items-center gap-2 disabled:opacity-50"
			>
				<Save size={18} />{" "}
				{savingMode === "draft" ? "保存中..." : "保存草稿"}
			</button>
			<button
				type="submit"
				disabled={Boolean(savingMode)}
				className="px-8 py-2.5 bg-[#c8951e] text-white rounded font-medium hover:bg-[#dca828] transition-all flex items-center gap-2 disabled:opacity-50"
			>
				<Sparkles size={18} />{" "}
				{savingMode === "pending" ? "提交中..." : "提交审核"}
			</button>
		</div>
	);
});

WikiEditorMetaSidebar.displayName = "WikiEditorMetaSidebar";

export default WikiEditorMetaSidebar;
