import {
	ConverseCommand,
	ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { GenerationPlugin } from "ragpipe";
import {
	type BedrockClientOptions,
	createBedrockRuntimeClient,
} from "./client.js";
import { assertSupportedGenerationModel } from "./helpers.js";

const DEFAULT_MODEL = "anthropic.claude-3-5-haiku-20241022-v1:0";

export interface BedrockGenerationOptions extends BedrockClientOptions {
	model?: string;
	systemPrompt?: string;
	maxTokens?: number;
	temperature?: number;
	topP?: number;
}

function buildUserPrompt(
	question: string,
	context: string,
	opts?: { history?: string; systemPrompt?: string },
): string {
	let prompt = `Context:\n${context}\n\nQuestion: ${question}`;
	if (opts?.history) {
		prompt = `Conversation history:\n${opts.history}\n\n${prompt}`;
	}
	return prompt;
}

function extractTextFromConverseOutput(
	output: { message?: { content?: { text?: string }[] } } | undefined,
): string {
	const content = output?.message?.content;
	if (!content || content.length === 0) return "";
	return content[0].text ?? "";
}

export function bedrockGeneration(
	options: BedrockGenerationOptions,
): GenerationPlugin {
	const model = options.model ?? DEFAULT_MODEL;
	const client = createBedrockRuntimeClient(options);

	function buildSystemText(opts?: {
		history?: string;
		systemPrompt?: string;
	}): string {
		return (
			opts?.systemPrompt ??
			options.systemPrompt ??
			"Answer based on the provided context."
		);
	}

	return {
		name: "bedrock",
		model,

		async generate(question, context, opts) {
			assertSupportedGenerationModel(model);

			const res = await client.send(
				new ConverseCommand({
					modelId: model,
					system: [{ text: buildSystemText(opts) }],
					messages: [
						{
							role: "user",
							content: [{ text: buildUserPrompt(question, context, opts) }],
						},
					],
					inferenceConfig: {
						maxTokens: options.maxTokens ?? 1024,
						temperature: options.temperature ?? 0.2,
						topP: options.topP ?? 0.9,
					},
				}),
			);

			return extractTextFromConverseOutput(res.output);
		},

		async *generateStream(question, context, opts) {
			assertSupportedGenerationModel(model);

			const res = await client.send(
				new ConverseStreamCommand({
					modelId: model,
					system: [{ text: buildSystemText(opts) }],
					messages: [
						{
							role: "user",
							content: [{ text: buildUserPrompt(question, context, opts) }],
						},
					],
					inferenceConfig: {
						maxTokens: options.maxTokens ?? 1024,
						temperature: options.temperature ?? 0.2,
						topP: options.topP ?? 0.9,
					},
				}),
			);

			for await (const chunk of res.stream ?? []) {
				const text = chunk.contentBlockDelta?.delta?.text;
				if (text) yield text;
			}
		},
	};
}
