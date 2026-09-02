export const PARTICIPANT_ROLES = ['zakazchik', 'bosh_pudratchi', 'subpudratchi', 'loyihachi', 'taminotchi'] as const;
export type ParticipantRole = typeof PARTICIPANT_ROLES[number];
export type ParticipantStatus = 'active' | 'pending' | 'suspended' | 'removed';
export type InvitationState = 'idle' | 'sending' | 'sent' | 'failed' | 'expired';
export type ProjectParticipant = { id: string; company: string; role: ParticipantRole; status: ParticipantStatus; joinedAt?: string | null; contact?: string | null; contractRelation?: string | null; permissions?: string[]; };
export type ParticipantInvitation = { id: string; company: string; emailOrIdentifier: string; role: ParticipantRole; project: string; state: InvitationState; sentAt?: string | null; message?: string | null; };
export type InviteParticipantInput = { company: string; emailOrIdentifier: string; role: ParticipantRole; project: string; message?: string; };
