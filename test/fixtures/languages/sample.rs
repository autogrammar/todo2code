use std::fmt;

pub const MAX_ITEMS: usize = 16;

pub struct Entry {
    pub id: String,
}

pub trait Describe {
    fn describe(&self) -> String;
}

impl Describe for Entry {
    fn describe(&self) -> String {
        format!("{}", self.id)
    }
}

pub fn build(id: &str) -> Entry {
    Entry { id: id.to_owned() }
}

fn render(entry: &Entry) -> String {
    entry.describe()
}
