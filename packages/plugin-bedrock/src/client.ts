import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

export interface BedrockCredentials {
	accessKeyId: string;
	secretAccessKey: string;
	sessionToken?: string;
}

export interface BedrockClientOptions {
	region: string;
	credentials?: BedrockCredentials;
	endpoint?: string;
}

export function createBedrockRuntimeClient(options: BedrockClientOptions) {
	return new BedrockRuntimeClient({
		region: options.region,
		credentials: options.credentials,
		endpoint: options.endpoint,
	});
}
