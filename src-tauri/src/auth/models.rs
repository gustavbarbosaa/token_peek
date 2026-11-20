use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountStatus {
    pub connected: bool,
    pub name: Option<String>,
    pub email: Option<String>,
    pub plan_type: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginPrompt {
    pub login_id: String,
    pub user_code: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageSnapshot {
    pub limits: Vec<UsageLimit>,
    pub updated_at: i64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageLimit {
    pub window: String,
    pub used_percent: i32,
    pub window_duration_mins: Option<i64>,
    pub resets_at: Option<i64>,
}
