import unittest

from sockets.matchmaking import MatchmakingManager, QueueEntry


class MatchmakingManagerTests(unittest.TestCase):
    def setUp(self):
        self.manager = MatchmakingManager()

    def entry(self, token, game="chess", mode="ranked", rating=1200):
        return QueueEntry(
            token=token,
            sid=f"sid-{token}",
            username=token,
            game_name=game,
            mode=mode,
            is_guest=token.startswith("guest_"),
            rating=rating,
        )

    def test_ranked_players_are_matched_by_game_and_rating(self):
        self.assertIsNone(self.manager.enqueue(self.entry("one", rating=1200)))
        self.assertIsNone(self.manager.enqueue(self.entry("two", rating=1301)))
        match = self.manager.enqueue(self.entry("three", rating=1240))

        self.assertIsNotNone(match)
        self.assertEqual({entry.token for entry in match.entries}, {"one", "three"})
        self.assertEqual(len(self.manager.queues[('chess', 'ranked')]), 1)

    def test_casual_players_do_not_need_matching_rating(self):
        self.manager.enqueue(self.entry("one", mode="casual", rating=900))
        match = self.manager.enqueue(self.entry("two", mode="casual", rating=1800))

        self.assertIsNotNone(match)
        self.assertEqual({entry.token for entry in match.entries}, {"one", "two"})

    def test_ready_state_is_complete_only_for_both_players(self):
        self.manager.enqueue(self.entry("one"))
        match = self.manager.enqueue(self.entry("two"))

        self.manager.mark_ready(match.match_id, "one")
        self.assertFalse(self.manager.is_ready(match.match_id))
        self.manager.mark_ready(match.match_id, "two")
        self.assertTrue(self.manager.is_ready(match.match_id))


if __name__ == "__main__":
    unittest.main()
