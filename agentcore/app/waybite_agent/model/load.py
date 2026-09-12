import os
import boto3
from strands.models.bedrock import BedrockModel


def load_model() -> BedrockModel:
    """Get Bedrock model client using IAM credentials (developer-dongik profile in us-east-1)."""
    profile_name = os.environ.get("AWS_PROFILE", "developer-dongik")
    region_name = os.environ.get("AWS_REGION", "us-east-1")
    model_id = os.environ.get("BEDROCK_MODEL_ID", "us.anthropic.claude-sonnet-4-5-20250929-v1:0")

    try:
        session = boto3.Session(profile_name=profile_name, region_name=region_name)
    except Exception:
        session = boto3.Session(region_name=region_name)

    return BedrockModel(
        boto_session=session,
        model_id=model_id,
    )
