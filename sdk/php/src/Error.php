<?php

declare(strict_types=1);

namespace Todo2Code;

/** Raised for JSON-RPC errors, transport failures and non-completed tasks. */
final class Error extends \RuntimeException
{
    /** @var mixed */
    private $data;

    /** @param mixed $data */
    public function __construct(string $message, int $code = -32000, $data = null)
    {
        parent::__construct($message, $code);
        $this->data = $data;
    }

    /** @return mixed */
    public function data()
    {
        return $this->data;
    }
}
