import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
	applyThemeToDocument,
	mergeThemeQueryParams,
	resolveTheme,
	ThemeName,
	writeThemeStorage,
} from "../lib/theme";

interface ThemeContextValue {
	theme: ThemeName;
	isAcademy: boolean;
	setTheme: (theme: ThemeName) => void;
	toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
	theme: "default",
	isAcademy: false,
	setTheme: () => {},
	toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const location = useLocation();
	const navigate = useNavigate();
	const [theme, setThemeState] = useState<ThemeName>(() => {
		if (typeof window === "undefined") return "default";
		return resolveTheme(window.location.search, window.localStorage);
	});

	useEffect(() => {
		const nextTheme = resolveTheme(location.search, window.localStorage);
		setThemeState((current) => (current === nextTheme ? current : nextTheme));

		return () => {
			// no-op
		};
	}, [location.search]);

	useEffect(() => {
		applyThemeToDocument(theme);
	}, [theme]);

	const setTheme = useCallback(
		(nextTheme: ThemeName) => {
			const nextSearch = mergeThemeQueryParams(location.search, {}, nextTheme);
			const searchString = nextSearch.toString();
			navigate(
				{
					pathname: location.pathname,
					search: searchString ? `?${searchString}` : "",
					hash: location.hash,
				},
				{ replace: true },
			);

			if (typeof window !== "undefined") {
				writeThemeStorage(window.localStorage, nextTheme);
			}
			setThemeState(nextTheme);
		},
		[location.hash, location.pathname, location.search, navigate],
	);

	const toggleTheme = useCallback(() => {
		const nextTheme: ThemeName = theme === "academy" ? "default" : "academy";
		setTheme(nextTheme);
	}, [setTheme, theme]);

	const value = useMemo(
		() => ({
			theme,
			isAcademy: theme === "academy",
			setTheme,
			toggleTheme,
		}),
		[setTheme, theme, toggleTheme],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
};

export const useTheme = () => useContext(ThemeContext);
