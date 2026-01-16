const Poll = require("../models/Poll");
const Vote = require("../models/Vote");
const { logAction } = require("../utils/auditLogger");

/**
 * @desc Create a new Poll
 */
exports.createPoll = async (req, res) => {
  try {
    const { question, options, isAnonymous, expiresAt } = req.body;
    
    if (!options || options.length < 2) {
        return res.status(400).json({ message: "At least 2 options are required" });
    }

    const formattedOptions = options.map((opt, index) => ({
        id: `opt_${Date.now()}_${index}`,
        text: typeof opt === 'string' ? opt : opt.text
    })).filter(o => o.text && o.text.trim() !== "");

    const poll = await Poll.create({
        club: req.user.clubId,
        createdBy: req.user.id,
        question,
        options: formattedOptions,
        isAnonymous: !!isAnonymous, // ✅ Save the privacy setting
        expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    await logAction({ req, action: "POLL_CREATED", target: `Poll: ${question}` });

    res.status(201).json({ success: true, data: poll });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
/**
 * @desc Vote on a Poll
 */
exports.castVote = async (req, res) => {
  try {
    const { pollId, selectedOptionIds } = req.body;
    const userId = req.user.id;

    const poll = await Poll.findOne({ _id: pollId, club: req.user.clubId });
    if (!poll) return res.status(404).json({ message: "Poll not found" });
    if (new Date() > poll.expiresAt) return res.status(400).json({ message: "Poll has ended" });

    const existingVote = await Vote.findOne({ poll: pollId, user: userId });
    if (existingVote) return res.status(409).json({ message: "You have already voted." });

    await Vote.create({
        poll: pollId,
        user: userId,
        selectedOptionIds
    });

    res.json({ success: true, message: "Vote cast successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc Get Poll Results (Single)
 */
exports.getPollResults = async (req, res) => {
  try {
    const { pollId } = req.params;
    const poll = await Poll.findOne({ _id: pollId, club: req.user.clubId });
    if (!poll) return res.status(404).json({ message: "Poll not found" });

    const votes = await Vote.find({ poll: pollId });

    // Calculate Counts
    const results = poll.options.map(opt => {
        const count = votes.filter(v => v.selectedOptionIds.includes(opt.id)).length;
        return {
            optionId: opt.id,
            text: opt.text,
            count
        };
    });

    // 🔒 Metadata: Show 'who voted' ONLY if NOT Anonymous
    let voters = [];
    if (!poll.isAnonymous) {
        const detailedVotes = await Vote.find({ poll: pollId }).populate("user", "name");
        voters = detailedVotes.map(v => ({ name: v.user.name, choices: v.selectedOptionIds }));
    }

    res.json({
        success: true,
        data: {
            question: poll.question,
            results,
            totalVotes: votes.length,
            voters: poll.isAnonymous ? "HIDDEN" : voters
        }
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc Get All Polls (With User's Specific Choices)
 * This logic ensures the frontend can highlight WHICH option the user voted for.
 */
exports.getAllPolls = async (req, res) => {
  try {
    const { clubId, id: userId } = req.user;

    const polls = await Poll.find({ club: clubId }).sort({ createdAt: -1 });
    const pollIds = polls.map(p => p._id);

    // 1. Get current user's votes (to highlight their choice)
    const userVotesDocs = await Vote.find({ user: userId, poll: { $in: pollIds } });
    const userVoteMap = {};
    userVotesDocs.forEach(v => {
        userVoteMap[v.poll.toString()] = v.selectedOptionIds;
    });

    // 2. Aggregate ALL votes to count and collect names
    const voteData = await Vote.aggregate([
        { $match: { poll: { $in: pollIds } } },
        { $unwind: "$selectedOptionIds" }, 
        {
            $lookup: {
                from: "users", // Join with User table
                localField: "user",
                foreignField: "_id",
                as: "voterInfo"
            }
        },
        { $unwind: "$voterInfo" },
        { 
            $group: { 
                _id: { poll: "$poll", option: "$selectedOptionIds" }, 
                count: { $sum: 1 },
                // ✅ Collect names for public polls
                voters: { $push: { name: "$voterInfo.name", id: "$voterInfo._id" } }
            }
        }
    ]);

    // Map results for O(1) access
    const resultsMap = {};
    voteData.forEach(v => {
        const pId = v._id.poll.toString();
        const oId = v._id.option;
        if (!resultsMap[pId]) resultsMap[pId] = {};
        resultsMap[pId][oId] = { count: v.count, voters: v.voters };
    });

    // 3. Assemble Response
    const data = polls.map(p => {
        const pId = p._id.toString();
        const myChoices = userVoteMap[pId] || [];

        const results = p.options.map(opt => {
            const rawResult = resultsMap[pId]?.[opt.id] || { count: 0, voters: [] };
            
            return {
                optionId: opt.id,
                count: rawResult.count,
                // 🔒 PRIVACY LOGIC: Send empty array if anonymous
                voters: p.isAnonymous ? [] : rawResult.voters
            };
        });

        return {
            ...p.toObject(),
            userHasVoted: myChoices.length > 0, 
            userVotes: myChoices,
            isActive: new Date() <= p.expiresAt,
            results
        };
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
/**
 * @desc Delete a Poll
 */
exports.deletePoll = async (req, res) => {
  try {
    const { pollId } = req.params;
    const { clubId } = req.user;

    // 1. Find Poll (Ensure ownership)
    const poll = await Poll.findOne({ _id: pollId, club: clubId });
    if (!poll) return res.status(404).json({ message: "Poll not found" });

    // 2. Delete Associated Votes (Cleanup)
    await Vote.deleteMany({ poll: pollId });

    // 3. Delete Poll
    await Poll.findByIdAndDelete(pollId);

    // 4. Log Action
    await logAction({
        req,
        action: "POLL_DELETED",
        target: `Poll: ${poll.question}`
    });

    res.json({ success: true, message: "Poll deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};