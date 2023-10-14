module.exports = getBadgeAssignmentPropData = ({ assignee, badgeTitle, badgeId, startPeriodId }) => JSON.parse(`[
    [
      {
        "value": [
          "string",
          "details"
        ],
        "label": "content_group_label"
      },
      {
        "label": "assignee",
        "value": [
          "name",
          "${assignee}"
        ]
      },
      {
        "value": [
          "string",
          "${badgeTitle}"
        ],
        "label": "title"
      },
      {
        "value": [
          "string",
          "some text."
        ],
        "label": "description"
      },
      {
        "label": "badge",
        "value": [
          "int64",
          ${badgeId}
        ]
      },
      {
        "value": [
          "int64",
          ${startPeriodId}
        ],
        "label": "start_period"
      },
      {
        "label": "period_count",
        "value": [
          "int64",
          24
        ]
      }
    ]
 ]`)
 