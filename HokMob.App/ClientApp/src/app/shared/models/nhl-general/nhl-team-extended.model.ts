import {NhlPersonModel} from "@shared/models/nhl-general/nhl-person.model";
import {NhlTeamRecordModel} from "@shared/models/nhl-general/nhl-team-record.model";
import {NhlGameDayModel} from "@shared/models/nhl-schedule/nhl-game-day.model";
import {NhlLiveFeedTeamModel} from "@shared/models/nhl-live-feed/nhl-live-feed-team.model";

export class NhlTeamExtendedModel extends NhlLiveFeedTeamModel {

  public roster: {
    link: string,
    roster: NhlPersonModel[]
  }

  public previousSchedule: {
    totalItems: number,
    totalEvents: number,
    totalGames: number,
    totalMatches: number,
    metaData: any,
    dates: NhlGameDayModel[]
  }

  public record: NhlTeamRecordModel;
}
