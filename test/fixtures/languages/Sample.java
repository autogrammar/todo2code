package demo;

import java.util.List;

public final class Sample {
  private final List<String> values;

  public Sample(List<String> values) {
    this.values = values;
  }

  public String describe() {
    return String.join(",", values);
  }
}
