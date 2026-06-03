import React from "react";
import { Save, Send } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import {
	getWikiDraftButtonText,
	getWikiSubmitButtonText,
} from "../../lib/wikiWriteText";

interface WikiEditorMetaSidebarProps {
	savingMode: "draft" | "pending" | null;
	isAdmin: boolean;
	onSubmit: (status: "draft" | "pending") => void;
}

const WikiEditorMetaSidebar = React.memo(({
	savingMode,
	isAdmin,
	onSubmit,
}: WikiEditorMetaSidebarProps) => {
	const { t } = useI18n();
	const saveButtonText = getWikiDraftButtonText(t, savingMode);
	const submitButtonText = getWikiSubmitButtonText(t, isAdmin, savingMode === "pending");

	return (
		<div className="pt-6 flex flex-wrap justify-end gap-3">
			<button
				type="button"
				onClick={() => onSubmit("draft")}
				disabled={Boolean(savingMode)}
				className="px-6 py-2.5 bg-surface-alt text-text-secondary border border-border rounded text-sm font-medium hover:border-brand-gold hover:text-brand-gold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<Save size={16} />{" "}
				{saveButtonText}
			</button>
			<button
				type="submit"
				disabled={Boolean(savingMode)}
				className="px-8 py-2.5 theme-button-primary rounded text-sm font-medium active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<Send size={16} />{" "}
				{submitButtonText}
			</button>
		</div>
	);
});

WikiEditorMetaSidebar.displayName = "WikiEditorMetaSidebar";

export default WikiEditorMetaSidebar;
