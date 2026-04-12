declare module "better-sqlite3" {
	interface Statement {
		run(...params: unknown[]): unknown;
		get<T = Record<string, unknown>>(...params: unknown[]): T | undefined;
		all<T = Record<string, unknown>>(...params: unknown[]): T[];
	}

	interface Database {
		pragma(source: string): unknown;
		prepare(source: string): Statement;
		exec(source: string): void;
		close(): void;
	}

	interface DatabaseConstructor {
		new (path: string): Database;
	}

	const Database: DatabaseConstructor;
	export default Database;
}
