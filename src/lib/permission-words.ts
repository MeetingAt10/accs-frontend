// What each permission lets a role do, in words (QA 17 November: the matrix showed codes like "post.anonymous allow" and
// "Restriction manage"). A permission without words here shows its code, so a new one is never hidden.

export const permissionWords: Record<string, string> = {
  'feed.read': 'Read the feed',
  'post.create': 'Post in the feed',
  'post.anonymous': 'Post anonymously',
  'announcement.publish': 'Publish announcements',
  'message.send': 'Send messages',
  'roster.view': 'See class rosters',
  'calendar.view': 'Use the calendar',
  'todo.manage': 'Keep personal to-dos',
  'consultation.request': 'Request appointments',
  'consultation.decide': 'Accept or decline appointments',
  'report.create': 'File a concern',
  'report.viewOwn': 'See own concerns',
  'case.view': 'See cases',
  'case.act': 'Act on cases',
  'case.convert': 'Open case files',
  'cluster.review': 'Review similar reports',
  'analytics.view': 'See case analytics',
  'evaluation.fill': 'Answer evaluations',
  'evaluation.review': 'Review evaluation questions',
  'evaluation.configure': 'Set up evaluation cycles',
  'evaluation.results': 'See evaluation results',
  'offense.view': 'See student records',
  'goodmoral.review': 'Review Good Moral requests',
  'restriction.manage': 'Manage restrictions',
  'strike.recommend': 'Recommend strikes',
  'student.report': 'Report a student',
  'clearance.view': 'See clearance',
  'load.manage': 'Manage faculty load',
  'strike.record': 'Record strikes',
  'standing.viewOwn': 'See own account standing',
  'moderation.review': 'Review flagged content',
  'moderation.referral': 'Decide referred flags',
  'moderation.osas': 'Decide flags sent to OSAS',
  'role.manage': 'Manage users and roles',
  'audit.view': 'See the audit trail',
  'directory.view': 'Use the directory',
  'self.manage': 'Manage own account',
  'assistant.use': 'Use the assistant',
  'account.activateSecretary': 'Activate the secretary account',
  'account.setupDean': 'Set up the Dean account',
  'account.provision': 'Create faculty and student accounts',
}

/** The words for a permission, or its code when it has none. */
export const permissionLabel = (key: string) => permissionWords[key] ?? key

/** The group heading a permission sits under ("Post" for post.create). */
export const permissionGroup = (key: string) => {
  const group = key.split('.')[0] ?? ''
  return group.charAt(0).toUpperCase() + group.slice(1)
}

/** A proposed change in words: "Allow Dean to Post anonymously", "Remove Student from Use the calendar". */
export const proposalWords = (roleLabel: string, key: string, allowed: boolean) =>
  allowed ? `Allow ${roleLabel} to ${permissionLabel(key).charAt(0).toLowerCase()}${permissionLabel(key).slice(1)}` : `Take "${permissionLabel(key)}" from ${roleLabel}`
