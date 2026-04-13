import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import clsx from "clsx";

interface FormModalProps {
	open: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
	onSubmit?: (e: React.FormEvent) => void;
	submitText?: string;
	cancelText?: string;
	loading?: boolean;
	maxWidth?: string;
}

export const FormModal = ({
	open,
	onClose,
	title,
	children,
	onSubmit,
	submitText = "提交",
	cancelText = "取消",
	loading = false,
	maxWidth = "max-w-md",
}: FormModalProps) => {
	if (typeof document === "undefined") return null;

	const content = (
		<>
			<div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
				{children}
			</div>

			<footer className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
				<button
					type="button"
					onClick={onClose}
					disabled={loading}
					className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
				>
					{cancelText}
				</button>
				{onSubmit && (
					<button
						type="submit"
						disabled={loading}
						className="px-5 py-2.5 rounded-xl bg-brand-olive text-white font-semibold hover:bg-brand-olive/90 transition-all disabled:opacity-50 inline-flex items-center gap-2"
					>
						{loading && <Loader2 size={16} className="animate-spin" />}
						{loading ? "提交中..." : submitText}
					</button>
				)}
			</footer>
		</>
	);

	return createPortal(
		<AnimatePresence>
			{open && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
					onClick={onClose}
				>
					<motion.div
						initial={{ opacity: 0, scale: 0.95, y: 8 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 8 }}
						className={clsx(
							"w-full bg-white rounded-3xl border border-gray-100 shadow-2xl flex flex-col max-h-[90vh]",
							maxWidth,
						)}
						onClick={(e) => e.stopPropagation()}
					>
						<header className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
							<h3 className="text-xl font-serif font-bold text-brand-olive">
								{title}
							</h3>
							<button
								type="button"
								onClick={onClose}
								className="p-2 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
							>
								<X size={20} />
							</button>
						</header>

						{onSubmit ? (
							<form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
								{content}
							</form>
						) : (
							<div className="flex flex-col flex-1 overflow-hidden">
								{content}
							</div>
						)}
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>,
		document.body,
	);
};
