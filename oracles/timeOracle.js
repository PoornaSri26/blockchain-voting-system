const axios = require('axios');
const Web3 = require('web3');

class TimeOracle {
    constructor(web3Provider) {
        this.web3 = new Web3(web3Provider);
        this.timeServers = [
            'https://worldtimeapi.org/api/timezone/UTC',
            'https://timeapi.io/api/Time/current/zone?timeZone=UTC',
            'http://worldclockapi.com/api/json/utc/now'
        ];
    }

    /**
     * Get consensus time from multiple time servers
     */
    async getConsensusTime() {
        try {
            const timePromises = this.timeServers.map(server => this.fetchTimeFromServer(server));
            const timeResults = await Promise.allSettled(timePromises);
            
            const validTimes = timeResults
                .filter(result => result.status === 'fulfilled')
                .map(result => result.value);

            if (validTimes.length === 0) {
                throw new Error('No time servers responded');
            }

            // Calculate consensus time (median)
            const sortedTimes = validTimes.sort((a, b) => a - b);
            const consensusTime = sortedTimes[Math.floor(sortedTimes.length / 2)];

            return {
                consensusTime: consensusTime,
                timestamp: Date.now(),
                sources: validTimes.length,
                variance: this.calculateVariance(validTimes)
            };
        } catch (error) {
            throw new Error(`Failed to get consensus time: ${error.message}`);
        }
    }

    /**
     * Fetch time from a specific server
     */
    async fetchTimeFromServer(serverUrl) {
        try {
            const response = await axios.get(serverUrl, { timeout: 5000 });
            
            // Parse different time server formats
            if (serverUrl.includes('worldtimeapi.org')) {
                return new Date(response.data.utc_datetime).getTime();
            } else if (serverUrl.includes('timeapi.io')) {
                return new Date(response.data.dateTime).getTime();
            } else if (serverUrl.includes('worldclockapi.com')) {
                return new Date(response.data.currentDateTime).getTime();
            }
            
            throw new Error('Unknown time server format');
        } catch (error) {
            throw new Error(`Time server ${serverUrl} failed: ${error.message}`);
        }
    }

    /**
     * Calculate variance in time responses
     */
    calculateVariance(times) {
        if (times.length < 2) return 0;
        
        const mean = times.reduce((sum, time) => sum + time, 0) / times.length;
        const variance = times.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / times.length;
        
        return Math.sqrt(variance);
    }

    /**
     * Verify if current time is within election period
     */
    async verifyElectionTiming(electionStartTime, electionEndTime) {
        try {
            const consensusData = await this.getConsensusTime();
            const currentTime = consensusData.consensusTime;
            
            return {
                currentTime: currentTime,
                electionStartTime: electionStartTime,
                electionEndTime: electionEndTime,
                isBeforeStart: currentTime < electionStartTime,
                isDuringElection: currentTime >= electionStartTime && currentTime <= electionEndTime,
                isAfterEnd: currentTime > electionEndTime,
                timeToStart: Math.max(0, electionStartTime - currentTime),
                timeToEnd: Math.max(0, electionEndTime - currentTime),
                variance: consensusData.variance
            };
        } catch (error) {
            throw new Error(`Failed to verify election timing: ${error.message}`);
        }
    }

    /**
     * Schedule election state changes based on time
     */
    async scheduleElectionEvents(electionId, startTime, endTime, callback) {
        try {
            const timing = await this.verifyElectionTiming(startTime, endTime);
            
            // Schedule start event
            if (timing.isBeforeStart) {
                setTimeout(() => {
                    callback('election_started', {
                        electionId: electionId,
                        timestamp: Date.now(),
                        event: 'start'
                    });
                }, timing.timeToStart);
            }
            
            // Schedule end event
            if (timing.isDuringElection) {
                setTimeout(() => {
                    callback('election_ended', {
                        electionId: electionId,
                        timestamp: Date.now(),
                        event: 'end'
                    });
                }, timing.timeToEnd);
            }
            
            return {
                scheduled: true,
                startScheduled: timing.isBeforeStart,
                endScheduled: timing.isDuringElection,
                timing: timing
            };
        } catch (error) {
            throw new Error(`Failed to schedule election events: ${error.message}`);
        }
    }

    /**
     * Create time-locked commitment for delayed revelation
     */
    async createTimeLockedCommitment(data, unlockTime) {
        try {
            const commitment = this.web3.utils.keccak256(JSON.stringify({
                data: data,
                unlockTime: unlockTime,
                nonce: this.web3.utils.randomHex(32)
            }));
            
            return {
                commitment: commitment,
                unlockTime: unlockTime,
                canUnlock: Date.now() >= unlockTime
            };
        } catch (error) {
            throw new Error(`Failed to create time-locked commitment: ${error.message}`);
        }
    }

    /**
     * Verify time-based proofs
     */
    async verifyTimeProof(proof, expectedTime, tolerance = 300000) { // 5 minute tolerance
        try {
            const consensusData = await this.getConsensusTime();
            const timeDifference = Math.abs(consensusData.consensusTime - expectedTime);
            
            return {
                valid: timeDifference <= tolerance,
                timeDifference: timeDifference,
                tolerance: tolerance,
                consensusTime: consensusData.consensusTime,
                expectedTime: expectedTime
            };
        } catch (error) {
            throw new Error(`Failed to verify time proof: ${error.message}`);
        }
    }
}

module.exports = TimeOracle;
