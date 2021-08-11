// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.6.12;

interface ISharesTimeLock {
    function depositByMonths(uint256 amount, uint256 months, address receiver) external;
}