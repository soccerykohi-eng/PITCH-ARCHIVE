export const LOGIN_REWARDS = {
  daily: 30,
  wednesday: 50,
  streak: 100,
} as const;

const JST_OFFSET = 9 * 60 * 60 * 1000;

export function loginBonusDateKey(now = Date.now()) {
  const date = new Date(now + JST_OFFSET);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function shiftDateKey(key: string, days: number) {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function calculateLoginBonus(today: string, claimDates: string[]) {
  const claims = new Set(claimDates);
  const claimed = claims.has(today);
  let cursor = claimed ? today : shiftDateKey(today, -1);
  let consecutiveDays = 0;
  while (claims.has(cursor)) {
    consecutiveDays += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  const streakDay = claimed ? ((consecutiveDays - 1) % 7) + 1 : (consecutiveDays % 7) + 1;
  const streak = claimed ? streakDay : consecutiveDays % 7;
  const isWednesday = new Date(`${today}T00:00:00Z`).getUTCDay() === 3;
  const bonusType = streakDay === 7 ? "streak" : isWednesday ? "wednesday" : "daily";
  return {
    reward: LOGIN_REWARDS[bonusType],
    claimed,
    available: !claimed,
    streak,
    streakDay,
    nextStreakReward: LOGIN_REWARDS.streak,
    bonusType,
  };
}
