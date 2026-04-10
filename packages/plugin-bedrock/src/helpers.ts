const textDecoder = new TextDecoder();

export function assertSupportedEmbeddingModel(model: string): void {
	if (!model.startsWith("amazon.titan-embed-text")) {
		throw new Error(
			`Unsupported Bedrock embedding model: ${model}. MVP supports Titan embedding models only.`,
		);
	}
}

export function assertSupportedGenerationModel(model: string): void {
	if (!model.startsWith("anthropic.claude")) {
		throw new Error(
			`Unsupported Bedrock generation model: ${model}. MVP supports Claude models only.`,
		);
	}
}

export function decodeBedrockBody<T>(body: Uint8Array): T {
	return JSON.parse(textDecoder.decode(body)) as T;
}
