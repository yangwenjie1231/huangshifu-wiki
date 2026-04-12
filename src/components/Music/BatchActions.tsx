import React from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n';

interface BatchActionsProps {
	selectedCount: number;
	onCancelSelect: () => void;
	onBatchDelete: () => void;
}

const BatchActions: React.FC<BatchActionsProps> = ({
	selectedCount,
	onCancelSelect,
	onBatchDelete,
}) => {
	const { t } = useI18n();

	if (selectedCount === 0) return null;

	return (
		<motion.div
			initial={{ y: 100 }}
			animate={{ y: 0 }}
			className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-8"
		>
			<span className="text-sm font-bold">{t('music.selectedCount', { count: selectedCount })}</span>
			<div className="flex gap-4">
				<button
					onClick={onCancelSelect}
					className="text-sm text-gray-400 hover:text-white"
				>
					{t('music.cancelSelect')}
				</button>
				<button
					onClick={onBatchDelete}
					className="px-6 py-2 bg-red-500 text-white rounded-full text-sm font-bold hover:bg-red-600 transition-all"
				>
					{t('music.batchDelete')}
				</button>
			</div>
		</motion.div>
	);
};

export { BatchActions };
export type { BatchActionsProps };
