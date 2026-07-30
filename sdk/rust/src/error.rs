use std::fmt;

/// Errors returned by the SDK.
#[derive(Debug)]
pub enum Error {
    InvalidUrl(String),
    Io(std::io::Error),
    Json(serde_json::Error),
    Runtime { code: i64, message: String },
    Protocol(String),
}

impl fmt::Display for Error {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::InvalidUrl(value) => write!(formatter, "invalid url: {value}"),
            Error::Io(error) => write!(formatter, "io error: {error}"),
            Error::Json(error) => write!(formatter, "json error: {error}"),
            Error::Runtime { code, message } => write!(formatter, "todo2code error {code}: {message}"),
            Error::Protocol(message) => write!(formatter, "protocol error: {message}"),
        }
    }
}

impl std::error::Error for Error {}

impl From<std::io::Error> for Error {
    fn from(error: std::io::Error) -> Self {
        Error::Io(error)
    }
}

impl From<serde_json::Error> for Error {
    fn from(error: serde_json::Error) -> Self {
        Error::Json(error)
    }
}
