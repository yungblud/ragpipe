import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import type { EmbeddingPlugin } from "ragpipe";
import {
	type BedrockClientOptions,
	createBedrockRuntimeClient,
} from "./client.js";
import { assertSupportedEmbeddingModel, decodeBedrockBody } from "./helpers.js";

const DEFAULT_MODEL = "amazon.titan-embed-text-v2:0";

const DIMENSION_MAP: Record<string, number> = {
	"amazon.titan-embed-text-v2:0": 1024,
	"amazon.titan-embed-text-v1": 1536,
};

export interface BedrockEmbeddingOptions extends BedrockClientOptions {
	model?: string;
	dimensions?: 256 | 512 | 1024;
	normalize?: boolean;
}

interface TitanEmbeddingResponse {
	embedding: number[];
	inputTextTokenCount: number;
}

export function bedrockEmbedding(
	options: BedrockEmbeddingOptions,
): EmbeddingPlugin {
	const model = options.model ?? DEFAULT_MODEL;
	const client = createBedrockRuntimeClient(options);
	const dimensions = options.dimensions ?? DIMENSION_MAP[model] ?? 1024;
	const normalize = options.normalize ?? true;

	async function invoke(text: string): Promise<number[]> {
		assertSupportedEmbeddingModel(model);

		const body =
			model === "amazon.titan-embed-text-v2:0"
				? { inputText: text, dimensions, normalize }
				: { inputText: text };

		const res = await client.send(
			new InvokeModelCommand({
				modelId: model,
				contentType: "application/json",
				accept: "application/json",
				body: JSON.stringify(body),
			}),
		);

		const payload = decodeBedrockBody<TitanEmbeddingResponse>(res.body);
		return payload.embedding;
	}

	return {
		name: "bedrock",
		model,
		dimensions,
		rateLimit: { delayMs: 250 },
		embed: invoke,
		async embedMany(texts: string[]) {
			const result: number[][] = [];
			for (const text of texts) {
				result.push(await invoke(text));
			}
			return result;
		},
	};
}
