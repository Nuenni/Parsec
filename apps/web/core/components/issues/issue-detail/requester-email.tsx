/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import useSWR, { mutate } from "swr";
// i18n
import { useTranslation } from "@plane/i18n";
// ui
import { Input } from "@plane/ui";
// utils
import { cn } from "@plane/utils";
// services
import { IssueEmailLinkService } from "@/services/issue/email_link.service";

const issueEmailLinkService = new IssueEmailLinkService();

export const getIssueEmailLinkSWRKey = (issueId: string) => `ISSUE_EMAIL_LINK_${issueId}`;

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled?: boolean;
};

// Requester email isn't a field on the Issue model - it lives on the separate
// EmailIssueLink record, so it's saved through its own endpoint rather than
// issueOperations.update.
export const RequesterEmailInput = observer(function RequesterEmailInput(props: Props) {
  const { workspaceSlug, projectId, issueId, disabled } = props;
  const { t } = useTranslation();
  const swrKey = getIssueEmailLinkSWRKey(issueId);
  const { data: emailLink } = useSWR(swrKey, () =>
    issueEmailLinkService.fetchEmailLink(workspaceSlug, projectId, issueId)
  );

  const [value, setValue] = useState(emailLink?.requester_email ?? "");

  useEffect(() => {
    setValue(emailLink?.requester_email ?? "");
  }, [emailLink?.requester_email]);

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed === (emailLink?.requester_email ?? "")) return;
    if (trimmed.length === 0) {
      setValue(emailLink?.requester_email ?? "");
      return;
    }
    mutate(
      swrKey,
      issueEmailLinkService.updateEmailLink(workspaceSlug, projectId, issueId, { requester_email: trimmed }),
      {
        optimisticData: {
          ...emailLink,
          id: emailLink?.id ?? "",
          requester_name: emailLink?.requester_name ?? "",
          requester_email: trimmed,
        },
        rollbackOnError: true,
      }
    );
  };

  return (
    <Input
      mode="transparent"
      type="email"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      placeholder={t("issue.add.requester_email")}
      disabled={disabled}
      className={cn("w-full grow px-2 py-0.5 text-body-xs-regular")}
    />
  );
});
