# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from botocore.exceptions import ClientError

# Module imports
from plane.settings.storage import S3Storage
from plane.utils.exception_logger import log_exception


class ParsecS3Storage(S3Storage):
    """S3Storage plus the ability to download an object's raw bytes - needed to pull
    inline image attachments out of an inbound support email (see email_intake_task.py).
    Kept as a subclass here rather than a patch to S3Storage itself so that file stays
    identical to upstream.
    """

    def get_object_bytes(self, object_name):
        """Download an S3 object's content. Returns (bytes, content_type) or (None, None)."""
        try:
            response = self.s3_client.get_object(Bucket=self.aws_storage_bucket_name, Key=object_name)
            return response["Body"].read(), response.get("ContentType")
        except ClientError as e:
            log_exception(e)
            return None, None
