import React from "react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode;
	className?: string;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className = "", ...props }) => {
	return (
		<div className={`liquidGlass-wrapper bg-white ${className}`} {...props}>
			<div className="liquidGlass-effect"></div>
			<div className="liquidGlass-tint"></div>
			<div className="liquidGlass-shine"></div>
			<div className="liquidGlass-text">{children}</div>
		</div>
	);
};

export default GlassCard;
